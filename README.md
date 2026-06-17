# ABL Payroll Solutions V1.0

A cloud-based payroll processing and employee management system built for Philippine businesses.

## Features

- **Employee Management** – Add, edit, and manage employee records with government ID numbers and payroll types.
- **Payroll Processing** – Automated computation of SSS, PhilHealth, Pag-IBIG, and withholding tax deductions. Supports 15th and 30th cutoff cycles.
- **Attendance Tracking** – Record daily time-in/time-out and late deductions.
- **Leave Management** – Approve and track employee leave requests.
- **Loan Tracking** – Manage employee loans with per-cutoff amortization.
- **Payslip Export** – Generate payslip PDFs and export payroll data to Excel.
- **Reports** – View payroll history, summaries, and government contributions.

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth)

## Getting Started

### Run Locally

```sh
npm install
npm run dev
```

### Build for Production

```sh
npm run build
```

## Database (Supabase)

This project uses Supabase as its backend. Connection settings are stored in the `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

## License

This project is proprietary software owned by ABL Payroll Solutions. All rights reserved.
