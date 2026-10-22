// html-to-pdfmake ships without types; lib/pdf-export.ts uses it.
declare module 'html-to-pdfmake' {
  function htmlToPdfmake(html: string, options?: Record<string, unknown>): any;
  export = htmlToPdfmake;
}
