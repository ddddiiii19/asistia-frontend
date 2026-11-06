import { Pie } from '@/components/Encabezado';

export default function LayoutPublico({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <p className="mb-6 text-center text-3xl font-bold tracking-tight text-marca">AsistIA</p>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        </div>
      </main>
      <Pie />
    </div>
  );
}
