const axios = require('axios')

const twentyApiKey = process.env.TWENTY_API_KEY

async function batchDeleteUsers() {
  try {
    const options = {
      method: 'GET',
      url: 'https://api.twenty.com/rest/people',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${twentyApiKey}`,
      },
    }

    const { data } = await axios.request(options)
    const userIds = data.data.people.map(user => user.id)

    // Batch delete the users
    for (const id of userIds) {
      const deleteOptions = {
        method: 'DELETE',
        url: `https://api.twenty.com/rest/people/${id}`,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${twentyApiKey}`,
        },
      }

      try {
        const { data } = await axios.request(deleteOptions)
        console.log(`Deleted user with id ${id}:`, data)
      } catch (error) {
        console.error(`Error deleting user with id ${id}:`, error)
      }
    }
  } catch (error) {
    console.error('Error fetching users:', error)
  }
}

batchDeleteUsers()
