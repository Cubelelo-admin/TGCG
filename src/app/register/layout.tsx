import IframeAutoResize from "@/components/IframeAutoResize";

export default function RegisterLayout({
  children,
}: LayoutProps<"/register">) {
  return (
    <>
      <IframeAutoResize />
      {children}
    </>
  );
}
