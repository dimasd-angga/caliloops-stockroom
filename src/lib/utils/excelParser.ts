import * as xlsx from 'xlsx';

export type ParsedPOItem = {
  serialNumber: number; // 序号
  itemCode: string; // 货号
  itemName: string; // 货品名称
  specification: string; // 规格
  quantity: number; // 数量/Quantity
  unitPrice: number; // 单价 (extract number from "1.16 元/个")
  discount: number; // 优惠（元）
  amount: number; // 金额（元）
};

export type ParseResult = {
  items: ParsedPOItem[];
  errors: { row: number; error: string; data: any }[];
};

// Helper function to extract numeric value from Chinese currency strings
const extractNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove all non-numeric characters except decimal point and minus sign
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const parsePOItemsExcel = (file: File): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = xlsx.utils.sheet_to_json(worksheet);

        const items: ParsedPOItem[] = [];
        const errors: { row: number; error: string; data: any }[] = [];

        json.forEach((row, index) => {
          try {
            // Map Chinese column names to data
            const serialNumber = row['序号'] || row['SerialNumber'] || (index + 1);
            const itemCode = row['货号'] || row['ItemCode'] || '';
            const itemName = row['货品名称'] || row['ItemName'] || '';
            const specification = row['规格'] || row['Specification'] || '';
            const quantity = extractNumber(row['数量/Quantity'] || row['Quantity'] || 0);
            const unitPrice = extractNumber(row['单价'] || row['UnitPrice'] || 0);
            const discount = extractNumber(row['优惠（元）'] || row['Discount'] || 0);
            const amount = extractNumber(row['金额（元）'] || row['Amount'] || 0);

            // Validate required fields
            if (!itemCode) {
              errors.push({
                row: index + 2, // +2 because Excel row numbers start at 1 and first row is header
                error: 'Missing item code (货号)',
                data: row,
              });
              return;
            }

            if (quantity <= 0) {
              errors.push({
                row: index + 2,
                error: 'Invalid quantity (数量/Quantity must be greater than 0)',
                data: row,
              });
              return;
            }

            items.push({
              serialNumber: typeof serialNumber === 'number' ? serialNumber : (index + 1),
              itemCode,
              itemName,
              specification,
              quantity,
              unitPrice,
              discount,
              amount,
            });
          } catch (error: any) {
            errors.push({
              row: index + 2,
              error: error.message || 'Unknown parsing error',
              data: row,
            });
          }
        });

        resolve({ items, errors });
      } catch (error: any) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

// Helper to download Excel template
export const downloadPOItemsTemplate = () => {
  const templateData = [
    {
      '序号': 1,
      '货号': '0805-01',
      '货品名称': '跨境弧形软硅胶鲨鱼夹安全高级感软质抓夹柔软硅胶发夹不断发夹子',
      '规格': '颜色：10.5cm-软硅胶-浅卡其色方块',
      '数量/Quantity': 400,
      '单价': '1.16 元/个',
      '优惠（元）': -64,
      '金额（元）': 400,
    },
  ];

  const worksheet = xlsx.utils.json_to_sheet(templateData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'PO Items');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 8 },  // 序号
    { wch: 15 }, // 货号
    { wch: 50 }, // 货品名称
    { wch: 35 }, // 规格
    { wch: 15 }, // 数量
    { wch: 15 }, // 单价
    { wch: 12 }, // 优惠
    { wch: 12 }, // 金额
  ];

  xlsx.writeFile(workbook, 'PO_Items_Template.xlsx');
};
