import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatNumber = (num: number | string) => {
  if (!num) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const parseNumber = (str: string) => {
  return parseInt(str.replace(/\./g, ''), 10) || 0;
};

export interface ParsedRefundInfo {
  method: 'transfer' | 'cash' | null;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  cleanDescription: string;
}

export function parseRefundInfo(invoice: { description?: string | null; refund_method?: string; refund_bank_name?: string; refund_account_number?: string; refund_account_name?: string }): ParsedRefundInfo {
  // If explicitly stored in columns
  if (invoice.refund_method) {
    return {
      method: invoice.refund_method as 'transfer' | 'cash',
      bankName: invoice.refund_bank_name,
      accountNumber: invoice.refund_account_number,
      accountName: invoice.refund_account_name,
      cleanDescription: invoice.description || '',
    };
  }

  const description = invoice.description;
  if (!description) return { method: null, cleanDescription: '' };

  const transferRegex = /\[Hoàn trả qua Ngân hàng\]:\s*([^-]+)\s*-\s*STK:\s*([^-]+)\s*-\s*Chủ\s*TK:\s*([^\n]+)/i;
  const cashRegex = /\[Hoàn trả\]:\s*Nhận tiền mặt trực tiếp tại văn phòng/i;

  const transferMatch = description.match(transferRegex);
  if (transferMatch) {
    const cleanDesc = description.replace(/\[Hoàn trả qua Ngân hàng\]:[\s\S]*$/gi, '').trim();
    return {
      method: 'transfer',
      bankName: transferMatch[1]?.trim(),
      accountNumber: transferMatch[2]?.trim(),
      accountName: transferMatch[3]?.trim(),
      cleanDescription: cleanDesc,
    };
  }

  const cashMatch = description.match(cashRegex);
  if (cashMatch) {
    const cleanDesc = description.replace(/\[Hoàn trả\]:[\s\S]*$/gi, '').trim();
    return {
      method: 'cash',
      cleanDescription: cleanDesc,
    };
  }

  return {
    method: null,
    cleanDescription: description,
  };
}
