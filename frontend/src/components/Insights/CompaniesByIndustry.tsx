import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { supabase } from "../../supabaseClient";
import { BarChart3 } from "lucide-react";

type Row = { industry: string; c: number };

// Pastel palette
const PASTELS = [
  "#8ECAE6", // light blue
  "#BDE0FE", // powder blue
  "#CDB4DB", // lilac
  "#FFC8DD", // pink
  "#FFAFCC", // coral pink
  "#BDE5C8", // mint
  "#FFE5A5", // warm sand
  "#A3C4F3", // cornflower
  "#A0E7E5", // aqua mint
  "#FFCAD4", // soft rose
];

export default function CompaniesByIndustry() {
  const [data, setData] = useState<{ industry: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from<Row>("companies_by_industry")
          .select("*")
          .order("c", { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        setData(
          (data ?? []).map((r) => ({
            industry: r.industry ?? "Unknown",
            count: r.c ?? 0,
          }))
        );
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // sync with app theme
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mounted = false;
      obs.disconnect();
    };
  }, []);

  const gridColor = isDark ? "#2A2A2A" : "#E5E7EB";
  const axisColor = isDark ? "#CBD5E1" : "#475569";
  const trackColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 bg-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        
        <BarChart3 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Companies by Industry
        </h3>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-red-500">{error}</div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          No data.
        </div>
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 8, left: 92 }}
              barCategoryGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                type="number"
                dataKey="count"
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="industry"
                width={92}
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: isDark ? "rgba(148,163,184,0.10)" : "rgba(2,6,23,0.06)" }}
                contentStyle={{
                  background: isDark ? "#0b1220" : "#ffffff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 10,
                  color: axisColor,
                }}
                formatter={(value: any) => [`${value} companies`, "Count"]}
                labelFormatter={(label: any) => `Industry: ${label}`}
              />
              
              <Bar
                dataKey="count"
                radius={[7, 7, 7, 7]}
                background={{ fill: trackColor }}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={PASTELS[i % PASTELS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
