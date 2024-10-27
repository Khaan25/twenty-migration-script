const axios = require('axios')
const readline = require('readline')
require('dotenv').config()

// Validate environment variables
const requiredEnvVars = ['HUBSPOT_ACCESS_TOKEN', 'TWENTY_API_KEY']
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`)
  process.exit(1)
}

const hubspotApiKey = process.env.HUBSPOT_ACCESS_TOKEN
const twentyApiKey = process.env.TWENTY_API_KEY

// API client with rate limiting
const createApiClient = (baseURL, headers) => {
  const client = axios.create({ baseURL, headers })
  client.interceptors.response.use(
    response => response,
    async error => {
      if (error.response && error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 5
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        return client(error.config)
      }
      return Promise.reject(error)
    }
  )
  return client
}

const hubspotClient = createApiClient('https://api.hubapi.com', {
  Authorization: `Bearer ${hubspotApiKey}`,
  'Content-Type': 'application/json',
})

const twentyClient = createApiClient('https://api.twenty.com', {
  Authorization: `Bearer ${twentyApiKey}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
})

async function fetchHubSpotCompanies(after = null) {
  try {
    const params = {
      limit: 100,
      properties: 'name,website,phone,city,description,annualrevenue,numberofemployees,zip,country,industry,address',
      after,
    }
    const response = await hubspotClient.get('/crm/v3/objects/companies', { params })
    return {
      companies: response.data.results,
      nextPage: response.data.paging?.next?.after || null,
    }
  } catch (error) {
    console.error('Error fetching HubSpot companies:', error.message)
    throw error
  }
}

function mapCompanyDataToTwentyFormat(hubspotCompanies) {
  return hubspotCompanies.map(company => ({
    name: company.properties.name || 'NO NAME',
    domainName: {
      primaryLinkLabel: 'Website',
      primaryLinkUrl: company.properties.website || 'NO WEBSITE',
    },
    employees: parseInt(company.properties.numberofemployees) || 0,
    linkedinLink: {
      primaryLinkLabel: 'LinkedIn',
      primaryLinkUrl: company.properties.linkedin || 'NO LINKEDIN',
    },
    xLink: {
      primaryLinkLabel: 'X Link',
      primaryLinkUrl: company.properties.xlink || 'NO X LINK',
    },
    annualRecurringRevenue: {
      amountMicros: parseInt(company.properties.annualrevenue) || 0,
      currencyCode: 'USD',
    },
    address: {
      addressStreet1: company.properties.address || 'NO ADDRESS',
      addressCity: company.properties.city || 'NO CITY',
      addressPostcode: company.properties.zip || 'NO ZIP',
      addressCountry: company.properties.country || 'NO COUNTRY',
    },
    idealCustomerProfile: true,
    createdBy: { source: 'EMAIL' },
  }))
}

async function checkCompanyDuplicateInTwenty(company) {
  try {
    const response = await twentyClient.post('/rest/companies/duplicates', { data: [company] })
    return response.data.data.length > 0
  } catch (error) {
    console.error('Error checking for duplicates:', error.message)
    return false
  }
}

async function sendToTwentyCRM(mappedData, checkDuplicates) {
  const uniqueCompanies = []
  for (const company of mappedData) {
    if (checkDuplicates) {
      const isDuplicate = await checkCompanyDuplicateInTwenty(company)
      if (isDuplicate) {
        console.log(`Company ${company.name} already exists. Skipping.`)
        continue
      }
    }
    uniqueCompanies.push(company)
  }

  try {
    const response = await twentyClient.post('/rest/batch/companies', uniqueCompanies)
    console.log('Companies migrated successfully:', response.data.data)
  } catch (error) {
    console.error('Error migrating companies:', error.message)
    if (error.response) {
      console.error('API response:', error.response.data)
    }
  }
}

async function syncAllCompanies(checkDuplicates) {
  let after = null
  let allCompanies = []
  let syncedCompaniesCount = 0

  do {
    try {
      const { companies, nextPage } = await fetchHubSpotCompanies(after)
      if (companies && companies.length > 0) {
        allCompanies = allCompanies.concat(companies)
        syncedCompaniesCount += companies.length
        console.log(`Fetched ${syncedCompaniesCount} companies so far.`)

        // Process in batches of 100
        if (allCompanies.length >= 100) {
          const batch = allCompanies.splice(0, 100)
          const mappedCompanies = mapCompanyDataToTwentyFormat(batch)
          await sendToTwentyCRM(mappedCompanies, checkDuplicates)
          console.log(`Processed and sent ${batch.length} companies to Twenty CRM.`)
        }
      }
      after = nextPage
    } catch (error) {
      console.error('Error during sync:', error.message)
      break
    }
  } while (after)

  // Process any remaining companies
  if (allCompanies.length > 0) {
    const mappedCompanies = mapCompanyDataToTwentyFormat(allCompanies)
    await sendToTwentyCRM(mappedCompanies, checkDuplicates)
    console.log(`Processed and sent final batch of ${allCompanies.length} companies to Twenty CRM.`)
  }

  console.log(`All companies synced. Total synced: ${syncedCompaniesCount}.`)
}

function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.toLowerCase())
    })
  })
}

async function main() {
  try {
    const checkDuplicates = (await promptUser('Do you want to check for duplicates before migrating? (yes/no): ')) === 'yes'
    const startSync = (await promptUser('Do you want to start the sync? (yes/no): ')) === 'yes'

    if (startSync) {
      await syncAllCompanies(checkDuplicates)
    } else {
      console.log('Sync not started.')
    }
  } catch (error) {
    console.error('An error occurred:', error.message)
  }
}

main()
