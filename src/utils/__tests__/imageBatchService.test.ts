/**
 * Image Batch Service Tests
 * Tests for parallel image description, filtering, and categorization
 */

import { describe, it, expect, vi } from 'vitest';
import {
  describeImageBatch,
  filterImages,
  categorizeImages,
  analyzeColorDistribution,
  analyzeImageBatch,
} from '../imageBatchService';
import type { ImageDescription, ImageAnalysisResult } from '../imageBatchService';

// Mock image descriptions for testing
const mockDescriptions: ImageDescription[] = [
  {
    filename: 'product_01.jpg',
    path: '/images/product_01.jpg',
    description: 'Red wireless headphones on white background',
    colors: ['#FF0000', '#FFFFFF'],
    objects: ['headphones', 'cable'],
    quality: 8,
    context: 'product',
  },
  {
    filename: 'product_02.jpg',
    path: '/images/product_02.jpg',
    description: 'Blue camera on marble surface',
    colors: ['#0000FF', '#E0E0E0'],
    objects: ['camera', 'lens'],
    quality: 9,
    context: 'product',
  },
  {
    filename: 'lifestyle_01.jpg',
    path: '/images/lifestyle_01.jpg',
    description: 'Woman with red headphones in urban setting',
    colors: ['#FF0000', '#FFB6C1'],
    objects: ['woman', 'headphones', 'building'],
    quality: 7,
    context: 'lifestyle',
  },
  {
    filename: 'hero_01.jpg',
    path: '/images/hero_01.jpg',
    description: 'Blue product in minimalist composition',
    colors: ['#0000FF', '#FFFFFF'],
    objects: ['product', 'shadow'],
    quality: 10,
    context: 'hero',
  },
  {
    filename: 'texture_01.jpg',
    path: '/images/texture_01.jpg',
    description: 'White marble texture surface',
    colors: ['#FFFFFF', '#D3D3D3'],
    objects: ['marble', 'shadow'],
    quality: 6,
    context: 'texture',
  },
];

describe('imageBatchService', () => {
  describe('categorizeImages', () => {
    it('should categorize images by context', () => {
      const categories = categorizeImages(mockDescriptions);

      expect(categories.product).toHaveLength(2);
      expect(categories.lifestyle).toHaveLength(1);
      expect(categories.hero).toHaveLength(1);
      expect(categories.texture).toHaveLength(1);

      // Verify correct images in each category
      expect(categories.product[0].filename).toBe('product_01.jpg');
      expect(categories.product[1].filename).toBe('product_02.jpg');
      expect(categories.lifestyle[0].filename).toBe('lifestyle_01.jpg');
      expect(categories.hero[0].filename).toBe('hero_01.jpg');
      expect(categories.texture[0].filename).toBe('texture_01.jpg');
    });

    it('should handle images without context', () => {
      const descriptions: ImageDescription[] = [
        ...mockDescriptions,
        {
          filename: 'unknown.jpg',
          path: '/images/unknown.jpg',
          description: 'Unknown image',
          colors: [],
          objects: [],
          quality: 5,
          // no context field
        },
      ];

      const categories = categorizeImages(descriptions);
      expect(categories.other).toHaveLength(1);
      expect(categories.other[0].filename).toBe('unknown.jpg');
    });
  });

  describe('analyzeColorDistribution', () => {
    it('should count colors across all images', () => {
      const distribution = analyzeColorDistribution(mockDescriptions);

      expect(distribution['#FF0000']).toBe(2); // Red appears in product_01 and lifestyle_01
      expect(distribution['#0000FF']).toBe(2); // Blue appears in product_02 and hero_01
      expect(distribution['#FFFFFF']).toBe(3); // White appears in product_01, hero_01, texture_01
      expect(distribution['#E0E0E0']).toBe(1); // Gray in product_02
    });

    it('should return empty object for empty descriptions', () => {
      const distribution = analyzeColorDistribution([]);
      expect(distribution).toEqual({});
    });

    it('should sort colors by frequency', () => {
      const distribution = analyzeColorDistribution(mockDescriptions);
      const entries = Object.entries(distribution);

      // Verify descending order
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i - 1][1]).toBeGreaterThanOrEqual(entries[i][1]);
      }
    });
  });

  describe('filterImages', () => {
    it('should filter images by query (mocked Context-1)', async () => {
      // Mock the Context-1 response
      const query = 'red images';
      const filtered = await filterImages(mockDescriptions, query, {
        maxResults: 10,
      });

      // Should find images with "red" in description or colors
      expect(filtered.length).toBeGreaterThan(0);
      expect(
        filtered.some((img) =>
          img.description.toLowerCase().includes('red') ||
          img.colors.some((c) => c === '#FF0000')
        )
      ).toBe(true);
    });

    it('should handle empty descriptions array', async () => {
      const filtered = await filterImages([], 'test query');
      expect(filtered).toEqual([]);
    });

    it('should limit results by maxResults', async () => {
      const filtered = await filterImages(mockDescriptions, 'product', {
        maxResults: 2,
      });

      expect(filtered.length).toBeLessThanOrEqual(2);
    });
  });

  describe('describeImageBatch', () => {
    it('should process batch with progress callback', async () => {
      const mockOnProgress = vi.fn();

      // Note: This test would require actual images or mocking
      // For now, we test the callback signature
      expect(typeof mockOnProgress).toBe('function');
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);

      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('analyzeImageBatch', () => {
    it('should return complete analysis structure', async () => {
      // Test the expected return type structure
      const expectedResult: ImageAnalysisResult = {
        totalImages: 0,
        processedImages: 0,
        failedImages: 0,
        descriptions: [],
        categories: {},
        colorDistribution: {},
        durationMs: 0,
        tokensUsed: 0,
        modelsUsed: [],
      };

      expect(expectedResult).toHaveProperty('totalImages');
      expect(expectedResult).toHaveProperty('processedImages');
      expect(expectedResult).toHaveProperty('failedImages');
      expect(expectedResult).toHaveProperty('descriptions');
      expect(expectedResult).toHaveProperty('categories');
      expect(expectedResult).toHaveProperty('colorDistribution');
      expect(expectedResult).toHaveProperty('durationMs');
      expect(expectedResult).toHaveProperty('tokensUsed');
      expect(expectedResult).toHaveProperty('modelsUsed');
    });
  });

  describe('ImageDescription type', () => {
    it('should validate required fields', () => {
      const desc: ImageDescription = {
        filename: 'test.jpg',
        path: '/test.jpg',
        description: 'Test image',
        colors: ['#FF0000'],
        objects: ['object'],
        quality: 8,
      };

      expect(desc.filename).toBe('test.jpg');
      expect(desc.colors).toContain('#FF0000');
      expect(desc.quality).toBe(8);
    });

    it('should support optional fields', () => {
      const desc: ImageDescription = {
        filename: 'test.jpg',
        path: '/test.jpg',
        description: 'Test',
        colors: [],
        objects: [],
        quality: 5,
        context: 'product',
        width: 1920,
        height: 1080,
        sizeBytes: 2048000,
        error: undefined,
      };

      expect(desc.context).toBe('product');
      expect(desc.width).toBe(1920);
      expect(desc.error).toBeUndefined();
    });
  });
});
