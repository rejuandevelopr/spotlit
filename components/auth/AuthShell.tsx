import { Wordmark } from "@/components/spotlit/Brand";

export function AuthShell({ image, panel, children }: { image: string; panel: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-stone text-ink">
      <section className="relative flex min-h-[420px] flex-[1_1_440px] flex-col justify-between gap-10 overflow-hidden bg-ink p-6 text-white sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        <div className="relative">
          <Wordmark width={120} />
        </div>
        <div className="lg lg-refract flex max-w-[500px] flex-col gap-5 rounded-[28px] p-6 sm:p-8">{panel}</div>
      </section>
      <main className="flex flex-[1_1_480px] items-center justify-center px-6 py-14">
        <div className="flex w-full max-w-[400px] flex-col gap-7">{children}</div>
      </main>
    </div>
  );
}
