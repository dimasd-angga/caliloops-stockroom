'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { addSku, checkSkuExists } from '@/lib/services/skuService';
import { useSkuImageUpload } from '@/hooks/useSkuImageUpload';
import type { Sku } from '@/lib/types';

interface SkuCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onSkuCreated?: (sku: Sku) => void;
}

export function SkuCreationModal({ open, onOpenChange, storeId, onSkuCreated }: SkuCreationModalProps) {
  const { toast } = useToast();
  const [newSkuName, setNewSkuName] = React.useState('');
  const [newSkuCode, setNewSkuCode] = React.useState('');
  const [newSkuImageUrl, setNewSkuImageUrl] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Image upload state
  const [imageInputMethod, setImageInputMethod] = React.useState<'url' | 'upload'>('url');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { uploadImage, uploading, progress, error: uploadError, resetState } = useSkuImageUpload();

  const resetForm = () => {
    setNewSkuName('');
    setNewSkuCode('');
    setNewSkuImageUrl('');
    setImageInputMethod('url');
    setSelectedFile(null);
    setPreviewUrl('');
    resetState();
  };

  const handleFileSelect = (file: File) => {
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPG, PNG, WebP, or GIF image',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeId) {
      toast({ title: 'You must select a store to create an SKU.', variant: 'destructive' });
      return;
    }

    if (!newSkuCode) {
      toast({ title: 'SKU Code is required.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const skuExists = await checkSkuExists(newSkuCode, storeId);
      if (skuExists) {
        toast({
          title: 'SKU Code Exists',
          description: 'This SKU code already exists for the selected store.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      const finalSkuName = newSkuName.trim() === '' ? newSkuCode : newSkuName;

      // Handle image upload if file is selected
      let finalImageUrl = newSkuImageUrl;

      if (imageInputMethod === 'upload' && selectedFile) {
        try {
          const uploadResult = await uploadImage(selectedFile, storeId, newSkuCode);
          finalImageUrl = uploadResult.url;
        } catch (error) {
          console.error('Image upload failed:', error);
          // Show toast but don't block SKU creation
          toast({
            title: 'Image upload failed',
            description: 'SKU will be created without an image. You can add it later.',
            variant: 'destructive',
          });
          finalImageUrl = ''; // Proceed without image
        }
      }

      const skuData = {
        storeId,
        skuName: finalSkuName,
        skuCode: newSkuCode,
        imageUrl: finalImageUrl,
      };

      const skuId = await addSku(skuData);

      // Create the full SKU object to return
      const createdSku: Sku = {
        id: skuId,
        storeId,
        skuName: finalSkuName,
        skuCode: newSkuCode,
        imageUrl: finalImageUrl,
        remainingQuantity: 0,
        remainingPacks: 0,
      };

      toast({ title: 'SKU created successfully!' });
      resetForm();
      onOpenChange(false);

      // Call the callback with the created SKU
      if (onSkuCreated) {
        onSkuCreated(createdSku);
      }
    } catch (error) {
      console.error('Error creating SKU:', error);
      toast({ title: 'Error creating SKU', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New SKU</DialogTitle>
            <DialogDescription>
              Add a new stock keeping unit to the system for your store.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newSkuName">SKU Name (Optional)</Label>
              <Input
                id="newSkuName"
                value={newSkuName}
                onChange={(e) => setNewSkuName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newSkuCode">SKU Code</Label>
              <Input
                id="newSkuCode"
                value={newSkuCode}
                onChange={(e) => setNewSkuCode(e.target.value)}
                required
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label>Product Image (Optional)</Label>
              <Tabs
                value={imageInputMethod}
                onValueChange={(v) => setImageInputMethod(v as 'url' | 'upload')}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="url">Image URL</TabsTrigger>
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                </TabsList>

                <TabsContent value="url" className="space-y-3">
                  <Input
                    value={newSkuImageUrl}
                    onChange={(e) => setNewSkuImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    disabled={isSaving}
                  />
                </TabsContent>

                <TabsContent value="upload" className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                    disabled={isSaving}
                  />

                  {!selectedFile ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving}
                      className="w-full"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose Image
                    </Button>
                  ) : (
                    <div className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearFile}
                          disabled={isSaving || uploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploading && <Progress value={progress} className="h-2" />}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Max 5MB. Supported: JPG, PNG, WebP, GIF
                  </p>
                </TabsContent>
              </Tabs>

              {/* Image Preview */}
              {(previewUrl || newSkuImageUrl) && (
                <div className="border rounded-md p-3">
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <div className="relative w-full h-32 bg-muted rounded flex items-center justify-center">
                    <Image
                      src={previewUrl || newSkuImageUrl}
                      alt="Preview"
                      fill
                      className="object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Error */}
              {uploadError && (
                <p className="text-sm text-destructive">{uploadError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create SKU
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
