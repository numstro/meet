// Demo data for Doodle-style polling app

export const demoPolls = [
  {
    id: '1',
    title: 'Team Coffee Meeting',
    description: 'Let\'s grab coffee and catch up!',
    creator_name: 'Kenny',
    creator_email: 'kenny@example.com',
    location: 'Blue Bottle Coffee',
    deadline: '2024-11-20',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

export const demoPollOptions = [
  {
    id: '1',
    poll_id: '1',
    option_date: '2024-11-15',
    start_time: null,
    end_time: null,
    option_text: 'morning',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    poll_id: '1',
    option_date: '2024-11-15',
    start_time: null,
    end_time: null,
    option_text: 'afternoon',
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    poll_id: '1',
    option_date: '2024-11-16',
    start_time: null,
    end_time: null,
    option_text: 'morning',
    created_at: new Date().toISOString()
  }
]

export const demoPollResponses = [
  {
    id: '1',
    poll_id: '1',
    option_id: '1',
    participant_name: 'Alice',
    participant_email: 'alice@example.com',
    response: 'yes',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    poll_id: '1',
    option_id: '2',
    participant_name: 'Alice',
    participant_email: 'alice@example.com',
    response: 'maybe',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '3',
    poll_id: '1',
    option_id: '1',
    participant_name: 'Bob',
    participant_email: 'bob@example.com',
    response: 'no',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// Mock Supabase client for Doodle demo
export const createDemoSupabase = () => ({
  from: (table: string) => ({
    select: (columns: string = '*') => {
      let data: any[] = []
      if (table === 'polls') {
        data = demoPolls
      } else if (table === 'poll_options') {
        data = demoPollOptions
      } else if (table === 'poll_responses') {
        data = demoPollResponses
      }

      return {
        single: () => Promise.resolve({ 
          data: data[0] || null, 
          error: data.length === 0 ? { message: 'No rows found' } : null 
        }),
        eq: (column: string, value: any) => {
          console.log('Demo: Filtering', table, 'by', column, '=', value, 'from', data.length, 'items')
          const filteredData = data.filter((item: any) => {
            console.log('Comparing', item[column], 'with', value, 'result:', item[column] === value)
            return item[column] === value
          })
          console.log('Demo: Found', filteredData.length, 'matching items')
          
          return {
            single: () => {
              const result = {
                data: filteredData[0] || null, 
                error: filteredData.length === 0 ? null : null // Don't return error for demo
              }
              console.log('Demo: single() returning:', result)
              return Promise.resolve(result)
            },
            order: (orderBy: string, options?: any) => {
              return Promise.resolve({ data: filteredData, error: null })
            },
            then: (callback: any) => callback({ data: filteredData, error: null })
          }
        },
        order: (orderBy: string, options?: any) => {
          return Promise.resolve({ data: data, error: null })
        },
        then: (callback: any) => callback({ data: data, error: null })
      }
    },
    insert: (data: any) => {
      console.log('Demo: Would insert', data)
      const insertedData = Array.isArray(data) 
        ? data.map(item => ({ id: 'demo-' + Date.now() + Math.random(), ...item }))
        : [{ id: 'demo-' + Date.now(), ...data }]
      
      return {
        select: (columns: string = '*') => {
          return {
            single: () => Promise.resolve({ 
              data: insertedData[0], 
              error: null 
            })
          }
        },
        // For cases where select() is not called
        then: (callback: any) => callback({ 
          data: insertedData, 
          error: null 
        })
      }
    },
    update: (data: any) => ({
      eq: (column: string, value: any) => {
        console.log('Demo: Would update', { data, where: { [column]: value } })
        return Promise.resolve({ data: [data], error: null })
      }
    }),
    delete: () => ({
      eq: (column: string, value: any) => {
        console.log('Demo: Would delete where', column, '=', value)
        return Promise.resolve({ data: [], error: null })
      }
    }),
    eq: (column: string, value: any) => {
      console.log('Demo: Would filter by', { column, value })
      let filteredData = []
      
      if (table === 'polls') {
        filteredData = demoPolls.filter((p: any) => p[column] === value)
      } else if (table === 'poll_options') {
        filteredData = demoPollOptions.filter((o: any) => o[column] === value)
      } else if (table === 'poll_responses') {
        filteredData = demoPollResponses.filter((r: any) => r[column] === value)
      }

      return {
        select: (columns: string = '*') => {
          return {
            single: () => Promise.resolve({ 
              data: filteredData[0] || null, 
              error: filteredData.length === 0 ? { message: 'No rows found' } : null 
            })
          }
        },
        order: (orderBy: string, options?: any) => {
          console.log('Demo: Would order filtered data by', orderBy, options)
          return Promise.resolve({ data: filteredData, error: null })
        },
        // Direct promise resolution for simple .eq() calls
        then: (callback: any) => callback({ data: filteredData, error: null })
      }
    },
    order: (column: string, options?: any) => {
      console.log('Demo: Would order by', column, options)
      if (table === 'polls') {
        return Promise.resolve({ data: demoPolls, error: null })
      }
      if (table === 'poll_options') {
        return Promise.resolve({ data: demoPollOptions, error: null })
      }
      if (table === 'poll_responses') {
        return Promise.resolve({ data: demoPollResponses, error: null })
      }
      return Promise.resolve({ data: [], error: null })
    }
  }),
  
  // Mock RPC for poll summary
  rpc: (functionName: string, params: any) => {
    if (functionName === 'get_poll_summary') {
      const summary = demoPollOptions.map(option => ({
        option_id: option.id,
        option_date: option.option_date,
        start_time: option.start_time,
        end_time: option.end_time,
        option_text: option.option_text,
        yes_count: demoPollResponses.filter(r => r.option_id === option.id && r.response === 'yes').length,
        no_count: demoPollResponses.filter(r => r.option_id === option.id && r.response === 'no').length,
        maybe_count: demoPollResponses.filter(r => r.option_id === option.id && r.response === 'maybe').length,
        total_responses: demoPollResponses.filter(r => r.option_id === option.id).length
      }))
      return Promise.resolve({ data: summary, error: null })
    }
    return Promise.resolve({ data: [], error: null })
  }
})