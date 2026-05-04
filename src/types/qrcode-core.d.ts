declare module 'qrcode/lib/core/qrcode' {
  interface QRCodeModules {
    size: number;
    get(row: number, col: number): boolean | number;
  }

  interface QRCodeData {
    modules: QRCodeModules;
  }

  interface QRCodeCore {
    create(
      value: string,
      options?: {
        errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      },
    ): QRCodeData;
  }

  const QRCodeCore: QRCodeCore;

  export default QRCodeCore;
}
