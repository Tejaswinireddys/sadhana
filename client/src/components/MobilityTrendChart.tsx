import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * The mobility check-in trend line. Split out of MobilityCheckIn so recharts
 * is loaded lazily, and only when there is at least one point to draw — keep
 * every recharts import for that card in this file.
 */
export default function MobilityTrendChart({ data, totalDays, ticks, unit, valueLabel }: {
  data: Array<{ day: number; inches: number }>;
  totalDays: number;
  ticks: number[];
  unit: string;
  valueLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
          type="number"
          domain={[1, totalDays]}
          ticks={ticks}
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          label={{ value: "Day", position: "insideBottom", offset: -4, fontSize: 11 }}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          allowDecimals={false}
          label={{ value: unit, angle: -90, position: "insideLeft", fontSize: 11 }}
        />
        <RTooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v}`, valueLabel]}
          labelFormatter={(d) => `Day ${d}`}
        />
        <Line
          type="monotone"
          dataKey="inches"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "hsl(var(--primary))" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
