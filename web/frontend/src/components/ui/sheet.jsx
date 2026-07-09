import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in', className)}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetContent = React.forwardRef(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex flex-col bg-card shadow-xl transition ease-in-out data-[state=open]:duration-300 data-[state=closed]:duration-300',
        side === 'right' && 'inset-y-0 right-0 h-full w-[340px] border-l data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
        side === 'left'  && 'inset-y-0 left-0 h-full w-[340px] border-r',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded opacity-70 hover:opacity-100 focus:outline-none">
        <X size={18} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = 'SheetContent'

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-2 p-4 border-b border-l-[3px] border-l-primary', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('font-heading text-[10px] font-bold uppercase tracking-[.07em] text-muted-foreground', className)} {...props} />
))
SheetTitle.displayName = 'SheetTitle'

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle }
