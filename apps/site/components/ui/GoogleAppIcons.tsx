import type { SVGProps } from "react";

export type GoogleAppIconProps = SVGProps<SVGSVGElement> & { size?: number };

type IconProps = Readonly<GoogleAppIconProps>;

export function GoogleCalendarIcon({ size = 20, ...props }: IconProps) {
  return <svg aria-hidden="true" height={size} viewBox="0 0 192 192" width={size} xmlns="http://www.w3.org/2000/svg" {...props}><rect fill="none" height="136" rx="20" stroke="currentColor" strokeWidth="12" width="136" x="28" y="36" /><path d="M28 72h136M60 20v32M132 20v32M52 104h16M88 104h16M124 104h16M52 136h16M88 136h16M124 136h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="12" /></svg>;
}

export function GoogleMeetIcon({ size = 20, ...props }: IconProps) {
  return <svg aria-hidden="true" height={size} viewBox="0 0 192 192" width={size} xmlns="http://www.w3.org/2000/svg" {...props}><rect fill="none" height="116" rx="24" stroke="currentColor" strokeWidth="12" width="116" x="20" y="38" /><path d="m136 78 36-26v88l-36-26z" fill="currentColor" /></svg>;
}

export function GoogleChatIcon({ size = 20, ...props }: IconProps) {
  return <svg aria-hidden="true" height={size} viewBox="0 0 192 192" width={size} xmlns="http://www.w3.org/2000/svg" {...props}><path d="M42 32h108c22 0 40 18 40 40v20c0 22-18 40-40 40H98l-38 26c-8 5-18 0-18-10v-16c-23-1-40-18-40-40V72c0-22 18-40 40-40z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="12" /><path d="M64 82h64M64 108h40" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="12" /></svg>;
}

export function GoogleFormsIcon({ size = 20, ...props }: IconProps) {
  return <svg aria-hidden="true" height={size} viewBox="0 0 192 192" width={size} xmlns="http://www.w3.org/2000/svg" {...props}><rect fill="none" height="144" rx="16" stroke="currentColor" strokeWidth="12" width="116" x="38" y="24" /><path d="M68 64h56M68 96h56M68 128h36" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="12" /></svg>;
}

export function GoogleDriveIcon({ size = 20, ...props }: IconProps) {
  return <svg aria-hidden="true" height={size} viewBox="0 0 192 192" width={size} xmlns="http://www.w3.org/2000/svg" {...props}><path d="m70 24 26 0 52 90H96zM70 24 18 114h52l52-90zM18 114h130l26 46H44z" fill="currentColor" fillRule="evenodd" /></svg>;
}
