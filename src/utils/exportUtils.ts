import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import pptxgen from 'pptxgenjs';

/**
 * Export a chart element to PNG
 */
export async function exportChartToPng(
  element: HTMLElement,
  filename: string = 'chart',
  dpi: number = 300
): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      scale: dpi / 96, // Convert DPI to scale
      backgroundColor: '#ffffff',
      logging: false,
    });

    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `${filename}.png`);
      }
    }, 'image/png');
  } catch (error) {
    console.error('Error exporting chart to PNG:', error);
    throw error;
  }
}

/**
 * Export a chart element to SVG
 */
export async function exportChartToSvg(
  element: HTMLElement,
  filename: string = 'chart'
): Promise<void> {
  try {
    const svg = element.querySelector('svg');
    if (!svg) throw new Error('No SVG found in element');

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    saveAs(blob, `${filename}.svg`);
  } catch (error) {
    console.error('Error exporting chart to SVG:', error);
    throw error;
  }
}

/**
 * Export CSV data
 */
export function exportToCsv(
  data: Array<Record<string, any>>,
  filename: string = 'export'
): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers
      .map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if needed
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${filename}.csv`);
}

/**
 * Export to PDF with multiple charts
 */
export async function exportToPdf(
  options: {
    title: string;
    chartElements: Array<{
      element: HTMLElement;
      title?: string;
    }>;
    logo?: string;
    includeTimestamp?: boolean;
  }
): Promise<void> {
  try {
    const { title, chartElements, logo, includeTimestamp = true } = options;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Add logo if provided
    if (logo) {
      pdf.addImage(logo, 'PNG', margin, yPosition, 40, 15);
      yPosition += 20;
    }

    // Add title
    pdf.setFontSize(24);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, margin, yPosition);
    yPosition += 15;

    // Add timestamp
    if (includeTimestamp) {
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      const now = new Date().toLocaleString();
      pdf.text(`Generated: ${now}`, margin, yPosition);
      yPosition += 10;
    }

    // Add charts
    for (const chart of chartElements) {
      // Check if we need a new page
      if (yPosition > pageHeight - 100) {
        pdf.addPage();
        yPosition = margin;
      }

      // Add chart title
      if (chart.title) {
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 0);
        pdf.text(chart.title, margin, yPosition);
        yPosition += 10;
      }

      // Convert chart to image
      const canvas = await html2canvas(chart.element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;

      // Check if chart fits on current page
      if (yPosition + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 15;
    }

    pdf.save(`${title}.pdf`);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
}

/**
 * Export to PowerPoint with slides per chart
 */
export async function exportToPowerPoint(
  options: {
    title: string;
    chartElements: Array<{
      element: HTMLElement;
      title?: string;
      description?: string;
    }>;
    logo?: string;
    includeTimestamp?: boolean;
  }
): Promise<void> {
  try {
    const { title, chartElements, logo, includeTimestamp = true } = options;

    const prs = new pptxgen();

    // Set presentation properties
    (prs.defineLayout as any)({ name: 'LAYOUT1', master: 'MASTER1' });
    (prs.defineLayout as any)({ name: 'LAYOUT2', master: 'MASTER1' });

    // Add title slide
    const titleSlide = prs.addSlide();
    titleSlide.background = { color: 'FFFFFF' };

    if (logo) {
      titleSlide.addImage({
        path: logo,
        x: 0.5,
        y: 0.5,
        w: 1,
        h: 0.75,
      });
    }

    titleSlide.addText(title, {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: '000000',
      align: 'left',
    });

    if (includeTimestamp) {
      const now = new Date().toLocaleString();
      titleSlide.addText(`Generated: ${now}`, {
        x: 0.5,
        y: 6.5,
        w: 9,
        h: 0.5,
        fontSize: 10,
        color: '999999',
        align: 'left',
      });
    }

    // Add chart slides
    for (const chart of chartElements) {
      const slide = prs.addSlide();
      slide.background = { color: 'FFFFFF' };

      // Add title
      if (chart.title) {
        slide.addText(chart.title, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.5,
          fontSize: 28,
          bold: true,
          color: '000000',
        });
      }

      // Add description
      if (chart.description) {
        slide.addText(chart.description, {
          x: 0.5,
          y: 1.2,
          w: 9,
          h: 0.5,
          fontSize: 12,
          color: '666666',
        });
      }

      // Convert chart to image
      const canvas = await html2canvas(chart.element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // Calculate dimensions to fit slide
      const slideWidth = 10; // inches
      const slideHeight = 7.5; // inches
      const maxImgWidth = 9; // with margins
      const maxImgHeight = chart.title ? 5.5 : 6.5; // account for title

      const imgAspect = canvas.width / canvas.height;
      let imgWidth = maxImgWidth;
      let imgHeight = imgWidth / imgAspect;

      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = imgHeight * imgAspect;
      }

      const xPos = (slideWidth - imgWidth) / 2;
      const yPos = chart.title ? 1.5 : 0.5;

      slide.addImage({
        data: imgData,
        x: xPos,
        y: yPos,
        w: imgWidth,
        h: imgHeight,
      });
    }

    prs.writeFile({ fileName: `${title}.pptx` });
  } catch (error) {
    console.error('Error exporting to PowerPoint:', error);
    throw error;
  }
}

/**
 * Export JSON data
 */
export function exportToJson(
  data: any,
  filename: string = 'export'
): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, `${filename}.json`);
}

/**
 * Prepare data for export (flatten nested structures if needed)
 */
export function prepareDataForExport(
  data: any,
  flatten: boolean = true
): Array<Record<string, any>> {
  if (!Array.isArray(data)) {
    return [data];
  }

  if (!flatten) {
    return data;
  }

  // Flatten nested objects
  return data.map(item => flattenObject(item));
}

function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    }
  }

  return flattened;
}
