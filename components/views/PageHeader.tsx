export function PageHeader({ label, title, desc, actions }: { label: string; title: React.ReactNode; desc?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2.5">
        <span className="lab text-ash">{label}</span>
        <h1 className="serif m-0 text-[clamp(44px,5vw,68px)] leading-none">{title}</h1>
        {desc && <p className="m-0 max-w-[620px] text-[15px] leading-relaxed text-ash-2">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="card items-start">
      <h2 className="serif m-0 text-4xl leading-none">{title}</h2>
      <p className="m-0 max-w-[560px] text-[15px] leading-relaxed text-ash-2">{body}</p>
      {action}
    </section>
  );
}
