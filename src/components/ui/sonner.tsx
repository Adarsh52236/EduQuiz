import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          // Make non-error toasts feel like “status” not “error”
          success:
            "group-[.toaster]:border-emerald-200/60 group-[.toaster]:bg-emerald-50/40 dark:group-[.toaster]:border-emerald-900/50 dark:group-[.toaster]:bg-emerald-950/30",
          error:
            "group-[.toaster]:border-red-200/60 group-[.toaster]:bg-red-50/40 dark:group-[.toaster]:border-red-900/50 dark:group-[.toaster]:bg-red-950/30",
          info:
            "group-[.toaster]:border-blue-200/60 group-[.toaster]:bg-blue-50/40 dark:group-[.toaster]:border-blue-900/50 dark:group-[.toaster]:bg-blue-950/30",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
