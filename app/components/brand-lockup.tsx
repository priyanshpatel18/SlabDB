import Image from "next/image";
import { cn } from "cn";

export function BrandLockup({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Image
        src="/logo.png"
        alt=""
        width={64}
        height={64}
        className="size-8 object-contain"
        priority={priority}
      />
      <Image
        src="/wordmark.png"
        alt="Slab"
        width={178}
        height={62}
        className="-ml-1 h-6 w-auto object-contain"
        priority={priority}
      />
    </span>
  );
}
