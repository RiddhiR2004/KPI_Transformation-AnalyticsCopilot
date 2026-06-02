export function MultiSelect({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={`px-3 py-2 text-left text-xs font-semibold tracking-wide transition border-t border-l border-r border-b-4 border-[#303030] ${
                selected 
                  ? "bg-[#111111] text-[#FFE600] border-b-[#FFE600]" 
                  : "border-b-[#303030]/40 bg-[#1B1B1B] text-[#F5F5F5] hover:bg-[#111111] hover:text-[#FFE600] hover:border-b-[#FFE600]"
              }`}
              onClick={() => toggle(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
