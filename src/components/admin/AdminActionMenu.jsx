import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function AdminActionMenu({
  label = "Quick Actions",
  items = [],
  align = "left",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <span>{label}</span>
        <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open ? (
        <div
          className={[
            "absolute z-30 mt-2 min-w-[240px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
        >
          <div className="space-y-1">
            {items.map((item, index) => {
              if (item.type === "separator") {
                return <div key={`sep-${index}`} className="my-2 border-t border-slate-100" />;
              }

              if (item.children?.length) {
                return (
                  <div key={item.key || item.label} className="rounded-xl px-2 py-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-1 space-y-1">
                      {item.children.map((child) => (
                        <button
                          key={child.key || child.label}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            child.onClick?.();
                          }}
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={item.key || item.label}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
