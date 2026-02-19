import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Image from 'next/image';
import { ZoomIn } from 'lucide-react';

interface ImagePreviewDialogProps {
  imageUrl: string;
  alt: string;
  trigger?: React.ReactNode;
}

export const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = ({
  imageUrl,
  alt,
  trigger,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="cursor-pointer group relative">
        {trigger}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ZoomIn className="h-6 w-6 text-white" />
        </div>
      </div>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[70vh]">
          <Image
            src={imageUrl}
            alt={alt}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
