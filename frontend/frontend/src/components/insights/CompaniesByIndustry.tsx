import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
// عدّل هذا المسار لو اختلف عندك:
import { supabase } from "../../supabaseClient";
// (اختياري) أيقونة من lucide-react للعنوان
import { Factory } from "lucide-react";

type Row = { industry: string; c: number };

export default function CompaniesByIndustry() {
  const [data, setData] = useState<{ industry: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // reads from the view you already created in Supabase
        const { data, error } = await supabase
          .from<Row>("companies_by_industry")
          .select("*")
          .order("c", { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        setData((data ?? []).map((r) => ({ industry: r.industry ?? "Unknown", count: r.c ?? 0 })));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="rounded-xl border border-gray-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Companies by industry</h3>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-red-400">{error}</div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">No data.</div>
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 8, left: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                type="number"
                dataKey="count"
                stroke="#9ca3af"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="industry"
                width={80}
                stroke="#9ca3af"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #1f2937",
                  borderRadius: 8,
                }}
                formatter={(value: any) => [`${value} companies`, "Count"]}
                labelFormatter={(label: any) => `Industry: ${label}`}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
