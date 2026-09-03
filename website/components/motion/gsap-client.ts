type GsapModule = typeof import("gsap");
type ScrollTriggerModule = typeof import("gsap/ScrollTrigger");

let gsapPromise: Promise<{ gsap: GsapModule["default"]; ScrollTrigger: ScrollTriggerModule["ScrollTrigger"] }> | null = null;

export function loadGsap() {
  gsapPromise ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
    ([gsapModule, scrollTriggerModule]) => ({
      gsap: gsapModule.default,
      ScrollTrigger: scrollTriggerModule.ScrollTrigger,
    }),
  );
  return gsapPromise;
}
