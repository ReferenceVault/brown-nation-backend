import { ProductVariant, VariantKind } from '@prisma/client';

export function variantLabel(variant: ProductVariant): string {
  return variant.kind === VariantKind.HAMPER
    ? (variant.label ?? 'Hamper')
    : `${variant.cavityCount} Cavity`;
}
