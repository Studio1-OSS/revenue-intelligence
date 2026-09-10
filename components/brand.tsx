import Image from "next/image";
export function Brand() {
  return (
    <span className="brand-identity">
      <span className="brand-symbol">
        <Image src="/logo-v2.png" width={40} height={40} alt="" />
      </span>
      <span className="brand-wordmark">
        Revenue-
        <br />
        Intelligence
      </span>
    </span>
  );
}
