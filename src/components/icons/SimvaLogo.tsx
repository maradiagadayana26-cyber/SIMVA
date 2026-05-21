import { SVGProps } from "react"
import simvaLogoOficial from "../../assets/images/simva_logo_oficial.png";

export function SimvaLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  // We use the high-quality generated logo image for better branding fidelity
  return (
    <img 
      src={simvaLogoOficial} 
      alt="Simva Logo" 
      className={className}
      style={{ objectFit: 'contain' }}
      referrerPolicy="no-referrer"
    />
  )
}

