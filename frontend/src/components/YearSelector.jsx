import './YearSelector.css';

export default function YearSelector({ years, value, onChange }) {
  return (
    <select
      className="year-selector"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}
