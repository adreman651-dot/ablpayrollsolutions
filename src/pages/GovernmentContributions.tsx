import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Landmark, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function GovernmentContributions() {
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState({
    sss_employee: '4.5',
    sss_employer: '9.5',
    phic_rate: '5.0',
    hdmf_employee: '100.0',
    hdmf_employer: '100.0',
  });

  const fetchRates = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*');
      if (data) {
        const newRates = { ...rates };
        data.forEach(item => {
          if (item.key === 'sss_employee_rate') newRates.sss_employee = item.value;
          if (item.key === 'sss_employer_rate') newRates.sss_employer = item.value;
          if (item.key === 'phic_rate') newRates.phic_rate = item.value;
          if (item.key === 'hdmf_employee') newRates.hdmf_employee = item.value;
          if (item.key === 'hdmf_employer') newRates.hdmf_employer = item.value;
        });
        setRates(newRates);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = [
        { key: 'sss_employee_rate', value: rates.sss_employee },
        { key: 'sss_employer_rate', value: rates.sss_employer },
        { key: 'phic_rate', value: rates.phic_rate },
        { key: 'hdmf_employee', value: rates.hdmf_employee },
        { key: 'hdmf_employer', value: rates.hdmf_employer },
      ];

      for (const update of updates) {
        await supabase.from('system_settings').upsert({
          key: update.key,
          value: update.value,
          description: `Government rate setting for ${update.key}`
        }, { onConflict: 'key' });
      }

      toast.success("Government contribution rates saved successfully.");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Government Contributions</h1>
          <p className="text-muted-foreground">Manage PhilHealth (PHIC), Pag-IBIG (HDMF), and SSS contribution percentages and caps</p>
        </div>
        <Button onClick={handleSave} disabled={loading} className="gap-2">
          <Save className="w-4 h-4" />
          Save Configurations
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              SSS Contribution Schedule
            </CardTitle>
            <CardDescription>Social Security System standard payroll deductions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Employee Contribution (%)</label>
                <Input
                  type="number"
                  value={rates.sss_employee}
                  onChange={e => setRates({ ...rates, sss_employee: e.target.value })}
                  className="bg-slate-900 border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Employer Contribution (%)</label>
                <Input
                  type="number"
                  value={rates.sss_employer}
                  onChange={e => setRates({ ...rates, sss_employer: e.target.value })}
                  className="bg-slate-900 border-border"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              PhilHealth (PHIC) Schedule
            </CardTitle>
            <CardDescription>PhilHealth premium rate based on monthly basic salary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Premium Premium Rate (%)</label>
              <Input
                type="number"
                value={rates.phic_rate}
                onChange={e => setRates({ ...rates, phic_rate: e.target.value })}
                className="bg-slate-900 border-border"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              Pag-IBIG (HDMF) Schedule
            </CardTitle>
            <CardDescription>Home Development Mutual Fund fixed or percentage contributions</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Employee Contribution (₱)</label>
              <Input
                type="number"
                value={rates.hdmf_employee}
                onChange={e => setRates({ ...rates, hdmf_employee: e.target.value })}
                className="bg-slate-900 border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Employer Share (₱)</label>
              <Input
                type="number"
                value={rates.hdmf_employer}
                onChange={e => setRates({ ...rates, hdmf_employer: e.target.value })}
                className="bg-slate-900 border-border"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
