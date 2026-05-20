import { SVGProps } from "react"

export function SimvaLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  // We use the high-quality generated logo image for better branding fidelity
  return (
    <img 
      src="/src/assets/images/simva_logo_oficial.png" 
      alt="Simva Logo" 
      className={className}
      style={{ objectFit: 'contain' }}
      referrerPolicy="no-referrer"
    />
  )
}

