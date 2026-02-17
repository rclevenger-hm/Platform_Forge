export default function ServiceMap({ failed = false }) {
  return (
    <svg
      className="service-map"
      viewBox="0 0 440 240"
      role="img"
      aria-label="Relay service: clients connect through an API and cache to a database"
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#273741" strokeWidth=".7" />
        </pattern>
        <linearGradient id="cube" x2="1" y2="1">
          <stop stopColor="#3b5758" />
          <stop offset="1" stopColor="#1c2c35" />
        </linearGradient>
      </defs>
      <rect width="440" height="240" fill="url(#grid)" rx="20" />
      <g fill="none" stroke="#81b6a2" strokeWidth="2" strokeDasharray="5 5">
        <path d="M80 120H160M215 120H300M200 150V190H340V145M200 95V45H340V95" />
      </g>
      {[
        [70, 120, "CLIENTS"],
        [195, 120, "RELAY API"],
        [335, 55, "CACHE"],
        [335, 170, "DATABASE"],
      ].map(([x, y, label], i) => (
        <g key={label} transform={`translate(${x},${y})`}>
          <path
            d="M-32 -16L0 -33L32 -16V20L0 38L-32 20Z"
            fill="url(#cube)"
            stroke={failed && i === 1 ? "#f3ae79" : "#8dc7ad"}
          />
          <path d="M-32 -16L0 2L32 -16M0 2V38" fill="none" stroke="#607d77" />
          <circle
            cy="-13"
            r="5"
            fill={failed && i === 1 ? "#f3ae79" : "#c4f46d"}
          />
          <text
            y="60"
            textAnchor="middle"
            fill="#abc1c6"
            fontSize="9"
            fontFamily="monospace"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
