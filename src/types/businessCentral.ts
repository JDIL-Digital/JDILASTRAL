/**
 * Microsoft Dynamics 365 Business Central — type contracts.
 *
 * Reference: Business Central v2.0 REST API (OData/REST).
 * Field names mirror the BC API verbatim (camelCase) so payloads from
 * BC can be assigned directly to these types without translation.
 */

export interface BCAuthToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;        // seconds
  expires_at: number;        // epoch ms — derived on receipt
  ext_expires_in?: number;
  scope?: string;
}

export interface BCCompany {
  id: string;
  systemVersion: string;
  name: string;
  displayName: string;
  businessProfileId?: string;
  systemCreatedAt?: string;
  systemModifiedAt?: string;
}

export interface BCVendor {
  id: string;
  number: string;
  displayName: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    countryLetterCode?: string;
    postalCode?: string;
  };
  phoneNumber?: string;
  email?: string;
  website?: string;
  taxRegistrationNumber?: string;
  currencyCode?: string;
  irs1099Code?: string;
  paymentTermsId?: string;
  paymentMethodId?: string;
  balance?: number;
  blocked?: "All" | "Payment" | " " | "";
  lastModifiedDateTime?: string;
}

export interface BCLineItem {
  id: string;
  documentId?: string;
  sequence: number;
  itemId?: string;
  accountId?: string;
  lineType: "Comment" | "Account" | "Item" | "Resource" | "Fixed Asset" | "Charge";
  lineDetails?: Record<string, unknown>;
  description: string;
  unitOfMeasureId?: string;
  unitOfMeasureCode?: string;
  unitCost: number;
  quantity: number;
  discountAmount?: number;
  discountPercent?: number;
  discountAppliedBeforeTax?: boolean;
  amountExcludingTax: number;
  taxCode?: string;
  taxPercent?: number;
  totalTaxAmount?: number;
  amountIncludingTax: number;
  invoiceDiscountAllocation?: number;
  netAmount: number;
  netTaxAmount?: number;
  netAmountIncludingTax: number;
  expectedReceiptDate?: string;
  receivedQuantity?: number;
  invoicedQuantity?: number;
  invoiceQuantity?: number;
  receiveQuantity?: number;
}

export interface BCPurchaseOrder {
  id: string;
  number: string;
  orderDate: string;
  postingDate?: string;
  vendorId: string;
  vendorNumber: string;
  vendorName: string;
  payToName?: string;
  payToVendorId?: string;
  payToVendorNumber?: string;
  shipToName?: string;
  shipToContact?: string;
  buyFromAddressLine1?: string;
  buyFromAddressLine2?: string;
  buyFromCity?: string;
  buyFromCountry?: string;
  buyFromState?: string;
  buyFromPostCode?: string;
  shipToAddressLine1?: string;
  shipToCity?: string;
  shipToState?: string;
  shipToCountry?: string;
  shipToPostCode?: string;
  currencyCode: string;
  pricesIncludeTax?: boolean;
  paymentTermsId?: string;
  shipmentMethodId?: string;
  purchaser?: string;
  requestedReceiptDate?: string;
  discountAmount?: number;
  discountAppliedBeforeTax?: boolean;
  totalAmountExcludingTax: number;
  totalTaxAmount: number;
  totalAmountIncludingTax: number;
  fullyReceived?: boolean;
  status: "Draft" | "In Review" | "Open" | "Released" | "Canceled" | string;
  lastModifiedDateTime: string;
  purchaseOrderLines?: BCLineItem[];
}

export interface BCListResponse<T> {
  "@odata.context"?: string;
  "@odata.nextLink"?: string;
  value: T[];
}

export type BCSyncStatus = "synced" | "pending" | "error";

export interface BCSyncRecord {
  bcId: string;
  bcNumber: string;
  forgeId?: string;
  status: BCSyncStatus;
  lastSyncedAt: string | null;
  errorMessage?: string | null;
}
