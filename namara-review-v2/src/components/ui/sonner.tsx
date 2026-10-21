"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      mobileOffset={{ bottom: 88 }}
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "font-sans" } }}
      {...props}
    />
  );
}

export { Toaster };
