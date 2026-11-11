export default function Avatar({ pose, listening }) {
  return (
    <div className={`avatar pose-${pose}${listening ? " listening" : ""}`}>
      <svg viewBox="0 0 200 280" className="figure" role="img" aria-label="Margit">
        <ellipse cx="100" cy="258" rx="42" ry="8" fill="#e0d3c0" />
        <g className="figure-body">
          <g className="arm arm-left">
            <rect x="46" y="124" width="18" height="64" rx="9" fill="#f2c7a5" />
          </g>
          <g className="arm arm-right">
            <rect x="136" y="124" width="18" height="64" rx="9" fill="#f2c7a5" />
          </g>
          <path
            d="M78 128c-14 18-18 70-12 118h68c6-48 2-100-12-118-8 16-36 16-44 0z"
            fill="#2f6f6a"
          />
          <circle cx="100" cy="74" r="34" fill="#f2c7a5" />
          <path d="M68 70c2-30 62-34 66 2-12-16-54-16-66-2z" fill="#3a2a24" />
          <circle cx="88" cy="74" r="3.2" fill="#2b211c" />
          <circle cx="114" cy="74" r="3.2" fill="#2b211c" />
          <path
            className="mouth mouth-calm"
            d="M90 88q10 8 20 0"
            fill="none"
            stroke="#a85a52"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            className="mouth mouth-cheer"
            d="M88 86q12 16 24 0"
            fill="none"
            stroke="#a85a52"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="78" cy="84" r="5" fill="#f0a090" opacity="0.75" />
          <circle cx="122" cy="84" r="5" fill="#f0a090" opacity="0.75" />
        </g>
      </svg>
    </div>
  );
}
