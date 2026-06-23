import { supabase } from "@/integrations/supabase/client";
import { computeDailyRate, computeWithholdingTax, computeSSS, computePhilHealth, computePagIBIG } from "./payroll-utils";

export async function recalculatePayrollForDate(dateString: string) {
  // Find all payroll runs that cover this date
  const { data: runs, error: runsErr } = await supabase
    .from("payroll_runs")
    .select("*")
    .lte("period_start", dateString)
    .gte("period_end", dateString);

  if (runsErr || !runs || runs.length === 0) {
    console.log("No active payroll runs found for date:", dateString);
    return;
  }

  for (const run of runs) {
    try {
      const { data: employees, error: empErr } = await supabase.from("employees")
        .select("id, basic_salary, employee_code, payroll_type, sss_schedule, phic_schedule, hdmf_schedule, sss_contribution, phic_contribution, hdmf_contribution, sss_number, philhealth_number, pagibig_number").eq("employment_status", "active");
      if (empErr || !employees) continue;

      const start = new Date(run.period_start), end = new Date(run.period_end);
      const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      const cycleFactor = totalDays < 20 ? 0.5 : 1;
      const currentCutoff = run.cutoff_type || "both";

      const items = [];

      for (const emp of employees) {
        // Count days present (time_in and time_out are not null)
        const { data: attendance } = await supabase.from("attendance")
          .select("late_minutes, status, date, time_in, time_out")
          .eq("employee_id", emp.id)
          .gte("date", run.period_start)
          .lte("date", run.period_end);

        const daysPresent = (attendance || []).filter(a =>
          a.time_in && a.time_out
        ).length;

        const { data: leaveData } = await supabase.from("leaves")
          .select("duration")
          .eq("employee_id", emp.id)
          .eq("status", "approved")
          .gte("start_date", run.period_start)
          .lte("end_date", run.period_end);
        const leaveDays = (leaveData || []).reduce((sum, l) => sum + (l.duration || 0), 0);

        const dailyRate = emp.payroll_type === "hourly_rate" ? emp.basic_salary * 8 : computeDailyRate(emp.basic_salary);
        const effectiveDays = daysPresent + leaveDays;
        const grossPay = +(dailyRate * effectiveDays).toFixed(2);

        const shouldDeductSSS = emp.sss_schedule === "both" || emp.sss_schedule === currentCutoff;
        const shouldDeductPHIC = emp.phic_schedule === "both" || emp.phic_schedule === currentCutoff;
        const shouldDeductHDMF = emp.hdmf_schedule === "both" || emp.hdmf_schedule === currentCutoff;

        let sssMonthly = 0;
        if (Number((emp as any).sss_contribution) > 0) sssMonthly = Number((emp as any).sss_contribution);
        else if ((emp as any).sss_number && (emp as any).sss_number.trim() !== "") sssMonthly = computeSSS(emp.basic_salary).employee;

        let phMonthly = 0;
        if (Number((emp as any).phic_contribution) > 0) phMonthly = Number((emp as any).phic_contribution);
        else if ((emp as any).philhealth_number && (emp as any).philhealth_number.trim() !== "") phMonthly = computePhilHealth(emp.basic_salary).employee;

        let piMonthly = 0;
        if (Number((emp as any).hdmf_contribution) > 0) piMonthly = Number((emp as any).hdmf_contribution);
        else if ((emp as any).pagibig_number && (emp as any).pagibig_number.trim() !== "") piMonthly = computePagIBIG(emp.basic_salary).employee;

        const sssEE = shouldDeductSSS ? +(sssMonthly * cycleFactor).toFixed(2) : 0;
        const phEE = shouldDeductPHIC ? +(phMonthly * cycleFactor).toFixed(2) : 0;
        const piEE = shouldDeductHDMF ? +(piMonthly * cycleFactor).toFixed(2) : 0;

        const taxableIncome = Math.max(0, grossPay - sssEE - phEE - piEE);
        const tax = computeWithholdingTax(taxableIncome);

        const { data: loans } = await supabase.from("loans")
          .select("per_cutoff_amortization").eq("employee_id", emp.id).eq("status", "approved");
        const loanDeductions = +((loans || []).reduce((sum, l) => sum + (l.per_cutoff_amortization || 0), 0)).toFixed(2);

        const totalDeductions = +(sssEE + phEE + piEE + tax + loanDeductions).toFixed(2);
        const netPay = Math.max(0, grossPay - totalDeductions);

        items.push({
          payroll_run_id: run.id,
          employee_id: emp.id,
          basic_pay: grossPay,
          gross_pay: grossPay,
          late_deductions: 0,
          absence_deductions: 0,
          sss_contribution: sssEE,
          philhealth_contribution: phEE,
          pagibig_contribution: piEE,
          withholding_tax: +tax.toFixed(2),
          loan_deductions: 0,
          cash_advance: loanDeductions,
          other_deductions: 0,
          total_deductions: totalDeductions,
          net_pay: +netPay.toFixed(2),
        });
      }

      await supabase.from("payroll_items").delete().eq("payroll_run_id", run.id);
      const { error: insertErr } = await supabase.from("payroll_items").insert(items);
      if (insertErr) throw insertErr;
      console.log(`Automatically recalculated payroll for run ID: ${run.id}`);
    } catch (err) {
      console.error("Failed to automatically recalculate payroll for run:", run.id, err);
    }
  }
}
