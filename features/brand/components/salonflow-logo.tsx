import Image from "next/image";

type SalonFlowLogoProps = {
  size?: number;
  showName?: boolean;
  className?: string;
};

export function SalonFlowLogo({
  size = 72,
  showName = true,
  className = "",
}: SalonFlowLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src="/brand/salonflow-mark.svg"
        alt="Logo SalonFlow"
        width={size}
        height={size}
        priority
      />
      {showName ? (
        <span className="font-[family-name:var(--font-salonflow-display)] text-2xl font-semibold tracking-tight text-slate-950">
          SalonFlow
        </span>
      ) : null}
    </div>
  );
}
