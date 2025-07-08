import { callEndpoint } from '../../src/api/client'
import type {
  ResolvedServiceConfig,
  EndpointConfig,
} from '../../src/types/config'

describe('API Response Transformation Integration', () => {
  // Mock fetch globally
  beforeAll(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  const mockConfig: ResolvedServiceConfig = {
    serviceName: 'testapi',
    baseUrl: 'https://api.example.com',
    endpoints: [],
  }

  describe('field extraction', () => {
    it('should extract specific fields from response', async () => {
      const endpoint: EndpointConfig = {
        name: 'getUser',
        method: 'GET',
        path: '/users/{id}',
        transform: {
          fields: ['id', 'name', 'email', 'profile.avatar'],
        },
      }

      const mockResponse = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
          avatar: 'avatar.jpg',
          bio: 'Software Developer',
          location: 'San Francisco',
        },
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        permissions: ['read', 'write'],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
      })

      const result = await callEndpoint(mockConfig, endpoint, {
        path: { id: '1' },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
          avatar: 'avatar.jpg',
        },
      })
      expect(result.metadata?.transformed).toBe(true)
    })

    it('should handle array field extraction', async () => {
      const endpoint: EndpointConfig = {
        name: 'listProducts',
        method: 'GET',
        path: '/products',
        transform: {
          fields: [
            'products[*].id',
            'products[*].name',
            'products[*].price',
            'meta.total',
          ],
        },
      }

      const mockResponse = {
        products: [
          {
            id: 1,
            name: 'Product 1',
            price: 99.99,
            description: 'Description 1',
            stock: 10,
          },
          {
            id: 2,
            name: 'Product 2',
            price: 149.99,
            description: 'Description 2',
            stock: 5,
          },
        ],
        meta: {
          total: 2,
          page: 1,
          per_page: 10,
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
      })

      const result = await callEndpoint(mockConfig, endpoint)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        products: [1, 2],
        meta: {
          total: 2,
        },
      })
    })
  })

  describe('field renaming', () => {
    it('should rename fields in response', async () => {
      const endpoint: EndpointConfig = {
        name: 'getOrder',
        method: 'GET',
        path: '/orders/{id}',
        transform: {
          rename: {
            order_id: 'orderId',
            customer_name: 'customerName',
            'items[*].product_id': 'items[*].productId',
            total_amount: 'totalAmount',
          },
        },
      }

      const mockResponse = {
        order_id: 'ORD-123',
        customer_name: 'Jane Smith',
        items: [
          { product_id: 1, quantity: 2 },
          { product_id: 2, quantity: 1 },
        ],
        total_amount: 250.0,
        status: 'pending',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
      })

      const result = await callEndpoint(mockConfig, endpoint, {
        path: { id: 'ORD-123' },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        orderId: 'ORD-123',
        customerName: 'Jane Smith',
        items: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
        totalAmount: 250.0,
        status: 'pending',
      })
    })
  })

  describe('transformation pipeline', () => {
    it('should apply multiple transformations in sequence', async () => {
      const endpoint: EndpointConfig = {
        name: 'searchUsers',
        method: 'GET',
        path: '/users/search',
        transform: [
          {
            // First: extract specific fields
            fields: [
              'results[*].user_id',
              'results[*].full_name',
              'results[*].email_address',
              'total_count',
            ],
          },
          {
            // Second: rename fields
            rename: {
              results: 'users',
              total_count: 'total',
              'users[*].user_id': 'users[*].id',
              'users[*].full_name': 'users[*].name',
              'users[*].email_address': 'users[*].email',
            },
          },
        ],
      }

      const mockResponse = {
        results: [
          {
            user_id: 1,
            full_name: 'John Doe',
            email_address: 'john@example.com',
            profile_picture: 'john.jpg',
            created_at: '2024-01-01',
          },
          {
            user_id: 2,
            full_name: 'Jane Smith',
            email_address: 'jane@example.com',
            profile_picture: 'jane.jpg',
            created_at: '2024-01-02',
          },
        ],
        total_count: 2,
        page_info: {
          page: 1,
          per_page: 10,
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
      })

      const result = await callEndpoint(mockConfig, endpoint, {
        query: { q: 'john' },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        users: [1, 2],
        total: 2,
      })
    })
  })

  describe('caching with transformation', () => {
    it('should cache transformed data', async () => {
      const endpoint: EndpointConfig = {
        name: 'getSettings',
        method: 'GET',
        path: '/settings',
        cacheTTL: 300,
        transform: {
          fields: ['theme', 'language', 'notifications.email'],
          rename: {
            'notifications.email': 'emailNotifications',
          },
        },
      }

      const mockResponse = {
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          push: false,
          sms: false,
        },
        privacy: {
          shareData: false,
          analytics: true,
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
      })

      // First call - should hit API and transform
      const result1 = await callEndpoint(mockConfig, endpoint)

      expect(result1.success).toBe(true)
      expect(result1.data).toEqual({
        theme: 'dark',
        language: 'en',
        notifications: {},
        emailNotifications: true,
      })
      expect(result1.metadata?.cached).toBe(false)
      expect(result1.metadata?.transformed).toBe(true)

      // Second call - should return cached transformed data
      const result2 = await callEndpoint(mockConfig, endpoint)

      expect(result2.success).toBe(true)
      expect(result2.data).toEqual({
        theme: 'dark',
        language: 'en',
        notifications: {},
        emailNotifications: true,
      })
      expect(result2.metadata?.cached).toBe(true)
      expect(result2.metadata?.transformed).toBe(true)

      // Fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('should return original data if transformation fails', async () => {
      const endpoint: EndpointConfig = {
        name: 'getData',
        method: 'GET',
        path: '/data',
        transform: {
          fields: ['data.*.invalid.path'],
        },
      }

      const mockResponse = {
        data: 'not an object',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => mockResponse,
      })

      const result = await callEndpoint(mockConfig, endpoint)

      expect(result.success).toBe(true)
      // Should still get data even if transform fails
      expect(result.data).toEqual(mockResponse)
      expect(result.metadata?.transformed).toBe(true)
    })
  })
})
