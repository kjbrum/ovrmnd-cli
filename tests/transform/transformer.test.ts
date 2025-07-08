import { ResponseTransformer } from '../../src/transform/transformer'
import type { TransformConfig } from '../../src/types/config'

describe('ResponseTransformer', () => {
  describe('field extraction', () => {
    it('should extract simple fields', () => {
      const config: TransformConfig = {
        fields: ['id', 'name', 'email'],
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret',
        created_at: '2024-01-01',
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      })
    })

    it('should extract nested fields with dot notation', () => {
      const config: TransformConfig = {
        fields: [
          'id',
          'profile.name',
          'profile.avatar',
          'settings.theme',
        ],
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        id: 1,
        profile: {
          name: 'John Doe',
          avatar: 'avatar.jpg',
          bio: 'Software developer',
        },
        settings: {
          theme: 'dark',
          notifications: true,
        },
        private_data: 'secret',
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        id: 1,
        profile: {
          name: 'John Doe',
          avatar: 'avatar.jpg',
        },
        settings: {
          theme: 'dark',
        },
      })
    })

    it('should handle array extraction patterns', () => {
      const config: TransformConfig = {
        fields: ['items[*].id', 'total'],
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        items: [
          { id: 1, name: 'Item 1', price: 10, stock: 5 },
          { id: 2, name: 'Item 2', price: 20, stock: 3 },
          { id: 3, name: 'Item 3', price: 30, stock: 0 },
        ],
        total: 60,
        tax: 6,
        shipping: 5,
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        items: [1, 2, 3],
        total: 60,
      })
    })

    it('should handle array field extraction', () => {
      const config: TransformConfig = {
        fields: ['products[*]'],
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        products: [
          { id: 1, name: 'Product 1' },
          { id: 2, name: 'Product 2' },
        ],
        metadata: { count: 2 },
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        products: [
          { id: 1, name: 'Product 1' },
          { id: 2, name: 'Product 2' },
        ],
      })
    })

    it('should handle arrays of objects', () => {
      const config: TransformConfig = {
        fields: ['id', 'title'],
      }
      const transformer = new ResponseTransformer(config)

      const input = [
        {
          id: 1,
          title: 'Post 1',
          content: 'Content 1',
          author: 'Author 1',
        },
        {
          id: 2,
          title: 'Post 2',
          content: 'Content 2',
          author: 'Author 2',
        },
      ]

      const result = transformer.transform(input)

      expect(result).toEqual([
        { id: 1, title: 'Post 1' },
        { id: 2, title: 'Post 2' },
      ])
    })

    it('should handle missing fields gracefully', () => {
      const config: TransformConfig = {
        fields: ['id', 'name', 'missing.field'],
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        id: 1,
        name: 'Test',
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        id: 1,
        name: 'Test',
      })
    })
  })

  describe('field renaming', () => {
    it('should rename simple fields', () => {
      const config: TransformConfig = {
        rename: {
          user_id: 'userId',
          first_name: 'firstName',
          last_name: 'lastName',
        },
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        userId: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      })
    })

    it('should rename nested fields', () => {
      const config: TransformConfig = {
        rename: {
          'user.first_name': 'user.firstName',
          'user.last_name': 'user.lastName',
          'settings.dark_mode': 'settings.darkMode',
        },
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        user: {
          first_name: 'John',
          last_name: 'Doe',
          id: 1,
        },
        settings: {
          dark_mode: true,
          language: 'en',
        },
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        user: {
          firstName: 'John',
          lastName: 'Doe',
          id: 1,
        },
        settings: {
          darkMode: true,
          language: 'en',
        },
      })
    })

    it('should handle arrays when renaming', () => {
      const config: TransformConfig = {
        rename: {
          product_id: 'productId',
        },
      }
      const transformer = new ResponseTransformer(config)

      const input = [
        { product_id: 1, name: 'Product 1' },
        { product_id: 2, name: 'Product 2' },
      ]

      const result = transformer.transform(input)

      expect(result).toEqual([
        { productId: 1, name: 'Product 1' },
        { productId: 2, name: 'Product 2' },
      ])
    })
  })

  describe('combined operations', () => {
    it('should apply field extraction then renaming', () => {
      const config: TransformConfig = {
        fields: ['user_id', 'profile.full_name', 'created_at'],
        rename: {
          user_id: 'userId',
          'profile.full_name': 'profile.name',
          created_at: 'createdAt',
        },
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        user_id: 123,
        profile: {
          full_name: 'John Doe',
          email: 'john@example.com',
          avatar: 'avatar.jpg',
        },
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        password: 'secret',
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        userId: 123,
        profile: {
          name: 'John Doe',
        },
        createdAt: '2024-01-01',
      })
    })
  })

  describe('error handling', () => {
    it('should return original data on transform error', () => {
      const config: TransformConfig = {
        fields: ['circular.ref'],
      }
      const transformer = new ResponseTransformer(config)

      // Create circular reference
      const input: any = { id: 1 }
      input.circular = input

      const result = transformer.transform(input)

      // Should return original data due to JSON.stringify error
      expect(result).toBe(input)
    })

    it('should handle null/undefined data', () => {
      const config: TransformConfig = {
        fields: ['id', 'name'],
      }
      const transformer = new ResponseTransformer(config)

      expect(transformer.transform(null)).toBe(null)
      expect(transformer.transform(undefined)).toBe(undefined)
    })

    it('should handle non-object data', () => {
      const config: TransformConfig = {
        fields: ['id'],
      }
      const transformer = new ResponseTransformer(config)

      expect(transformer.transform('string')).toBe('string')
      expect(transformer.transform(123)).toBe(123)
      expect(transformer.transform(true)).toBe(true)
    })
  })

  describe('array indexing', () => {
    it('should extract specific array indices', () => {
      const config: TransformConfig = {
        fields: ['items[0].name', 'items[1].price'],
      }
      const transformer = new ResponseTransformer(config)

      const input = {
        items: [
          { name: 'First', price: 10 },
          { name: 'Second', price: 20 },
          { name: 'Third', price: 30 },
        ],
      }

      const result = transformer.transform(input)

      expect(result).toEqual({
        items: {
          '0': { name: 'First' },
          '1': { price: 20 },
        },
      })
    })
  })

  describe('no configuration', () => {
    it('should return original data when no config provided', () => {
      const config: TransformConfig = {}
      const transformer = new ResponseTransformer(config)

      const input = { id: 1, name: 'Test' }
      const result = transformer.transform(input)

      expect(result).toBe(input)
    })
  })
})
