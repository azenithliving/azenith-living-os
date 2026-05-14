import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const prisma = new PrismaClient();

const keys = [
  "8uTjvLvQvrybS8uL2Wc2kYI3N22xPMlv",
  "SyE8czJCXtI48XAQFrKSix8JtKN1mhLh",
  "INJ8WHmbzKGlzp9bf0pxMQNOXfkbQ0It",
  "muyZbmAIPoEpi5fu7T98tcAWvKaoPnxz",
  "0hYfhX0VIJOSaIF6nvzrpVaC0J6EVjQS",
  "QjKq82OZUTNt88cYwHM8fwBIUzaFRXeu",
  "xR28J0T3RihRUETwheic8XowK4y0upPP",
  "EfqzOmzL8HaotEv59jgxJWQXFRgWfKLq",
  "23pIOuQmTa62IgQdjtZnYunm0e2PGu56",
  "L902rRRbjHg8hqZe16GJZFiVaIzSQe8s",
  "Ci2w6EjguceuIq4OZGo3aTKm7Fde22t3",
  "twyZzbVRBRD7iMtiOz5jDMu6PB1dF7J6",
  "8SxnhLprQ4Jhg4mXI8xjygp43cMjmm7W",
  "jCfgE6YGCdQggQUDolDYH8qa05IqdLOf",
  "Z3pC7kaiPtBmx0veynml9m19CZEdHPjD",
  "UDilrF98mAfG7niExhfQH7Ntrj6TOlaC",
  "dTHDgBCWwTGh4tUbYX6lJTHV0S5tPWqG",
  "zJfm58YEJFkkWaDDZRgefzarMm5tSD4D",
  "EAFNJSCelMV5nzVN01zdgcWc0LNkJOvt",
  "KfvFr5sJFV5ndp7QqsApY9cVbpQKnWZl",
  "xm4KfxhqT9ycn04oF4Th37VWnwY813Ip",
  "DvwgD71MFBBoOMfZxm5TbEUWjxbeJePH",
  "m2JUdnzS16SXFqXvqFDVQu64YdRD61Ch",
  "24eHw3tpAZtqpMIzjqWwCDzJEVIuAxUZ",
  "OKzuzKeQiOvZlkgN9a0xUVP6vdYW7rRm",
  "TusZV6IAtr4mkMxuYorWgBnGFz1y43ij",
  "kRpSeYUqf4qoXElPQU68QIL7B8hdl4m1",
  "7a7w3eLQYWrNDfJcjFXbDM8sWmMNE7AY",
  "BnifV9mBsmOgUPl0KXvKLhDf9Ldms1A2",
  "EslNRw3K1dWT2fJybiGuYgP36qNV45pn",
  "wnFYTN0cmV0JrPEp0yB9qrBxvbmQj8Y3",
  "5Cwq64lD4984wP2S5vvGKuzUL1LmlT4g",
  "HesTrFDPuukgYFMrDCqAJKMzcA5Nz14F",
  "uAKeOqVcmRB3yHWh2e4HwZYl4jhjGOQA",
  "a4fnR76ZY0edvvTCt2GJAiI59pSHndXl",
  "hFc8lM7uYhXqBTJsgukxq54pmIKw8IzM",
  "6oMYxwWws4jqGnRYMholSYz6Dep4btPK",
  "q7vI5C45dlmc0obGpMI9ewdvITgVM07C",
  "yNoh6yqU7v713kl8n1VwRPLGyDlZMuJd",
  "Eb78jWDbbxEE32wwG9FPvp2lim2170Ar",
  "zpTOJl5c4r3gwvymVORQjj0NpAiIvHnK",
  "D6KoyZAlPHZ5LVPx2SEkmNibpUti18Ff",
  "VQhu4nfW0LOkXivbODghQm4MNHmljILm",
  "O6Bj751n2eAWkiuNyQ0RSYGi5PVOsYaH",
  "tcglPvV7oYzxsehKybvUbDVagnioAchd",
  "4VBcVkzmSgSGDlLpRB4zQ1tWRrRxRPyS",
  "2qzogbVnIzL5uh1xvXCq4P0OxLuQKiiQ",
  "zepEniQzRQUO21zfw6cMj9zcGFMKFPnO",
  "ulMtc47FCM3f5FgDk9loCDE9DGqhGbw2",
  "LSEeFhwgmV4ORdeZwH2hazVeZ4wtIV3L",
  "3LRj0kLXSLJYEgUtaLsEF8nGDgwqJmHN",
  "mclfC1nvMorxKz8nXvHPdnzE57Ht7J3d",
  "CZNibH542NLUwPIgJr3Pu6ni96BAZyQv",
  "sp65YDd384fKhZwjGxtNia9GuW4fc6ul",
  "noy1nj47XOQfvuYlFNDeMqp7IZhlEIy2",
  "HoyLyGWnBPxb0rxaXWoQPcJfnw06bw2n",
  "z9B9gGEaqvGwlTDX2hU0zIPFG8tZeL5W",
  "L7iGJ5R1h3N6m5IHXEjrPTU4mKKyrcpY",
  "KxZhvaCPtMzBpYWi8p0OKIyRgw4Kl2Kz",
  "18RPYXeOTn65mqBHhLQkVl3kybyyH4Wx",
  "KLP4yhLFua31SUyLUClSn5Kani2aJwrM",
  "nwHwNngpAx083OFHrqhoMH49L47gvz7k",
  "7mnMYTaqU7nREegtyHMHw8Y3651zLuAX",
  "mJPHyGt5jl0Lv5CSvwDF3oRbyI2W2Apc",
  "TwIbjVFQEBxJrYMnODsZNznFSblic8rI",
  "E4mhRSoVjU0mj3xsOKbrZHpAUea81jCu",
  "DUnuwWwOi9cdu4vMlMXuN2CicP7xyUh4",
  "GcjEQFbWHEOHo3vr24te7MFYnhQXNwtM",
  "AcuEz4NorNeTmvLZJBW4Ojgi3W6cJoY3",
  "mnM3omVRC6fFjH2ZDLjQAKvLZV2pOoMq",
  "9CPXKezwHHagvYTV4B7iqVt8SB1lN5Ne",
  "dnLEugXKpZEiCn1JLtEDxIX1wu0h157H",
  "kBa76Oi8fIADFWycfv7t5wzduNttxuuH",
  "FPe7A3ja6fmmytFhQrwptl62iaY9Mkqa",
  "btBZsKQmlXp200UETC2tl46PLnWmjVEx",
  "SoFogF1eCAJJjuYwvdaazFyRdITjJrWU",
  "BU0PAX2AFelWKqnEDLgxRp77kQTmY8Nn",
  "pJolH3zc9Gi4FXcXiUME6f1eOsq57oqn",
  "ivQVdHLbvTSTXQi7VeZDgyBCygQ9VkdR",
  "TGMGEcnyYiOFt1vzrwPN4JzsQ9WbDho3",
  "TFvU00FmFCkM37ntHND0rxLRnzLXQKvA",
  "9sTSea0puYXchNCKPjUblpezHuVghDt6",
  "F5YAPSrJdRv3mKIBfZ9TB5cYjEnX37Jw",
  "T4miv7qvkFZrPOd3HaUP5gJ27O6YMg2R",
  "rXFOVnFCFH7yK3sQzkPndfYLGWts8MOs",
  "JUaTRFhewV0UFPuyyToq1skAssgSmn7V",
  "H03hdThWsndNrClIFi9XtDZdwNT5YnVU",
  "kn8pUhX0YJ93rzwL434YgUmRCdiKo7iJ",
  "TMdCngRxGoDDTYn4jc0I5Cs5RHC8csLe",
  "TyiujE1oI5gsTOjdT8gvDaMqpRWnOVcq",
  "a92tpzeIbDe1uwSXlywDva6TkcAPRQAO",
  "Pg11HEiBFETu3THChxzJNWWmHA542KLH",
  "8nwphRS9ILiPixpH54771dCHLpCLJNQ4",
  "uUW1B1JZLByFVVBHRXEdhWDNWv6fsGHc",
  "AeLOt2drtOUkgHgl10Odgm0l8d7qf1O3",
  "bD866x2gXugkRjxUkn8Mg38KCUZm6nn7",
  "G3GZbNRnbQhvV9KFP4YXMd2VwNwynzHb",
  "vzxkGzOcmpxMVrTcBgTfXHTSu2ZtyJj5",
  "8in99hWJEcpufZHHRH2t6DyJcQJaTE76",
  "9qwgs0e2DUgipRdvoJnWxIoYkLOsZvfE",
  "TPlthKqZ8xsK7TH7rOTUhAh1IzVlCbOi",
  "vMxuuk3l4a8qBeBC3ijlTDsLNZJccBo5",
  "ZlztREXkWTjhzqoGnCarTUG1UdKKWLVE",
  "V2oRNTfYifA21dptOwl7lJJUU5RVv2bP",
  "db9G91xVEyRKX4wCKHkRAtipfOLfTZQD",
  "SB2Bd7pYHYAX3WQUU4uhoe9jwDcm4MrG",
  "TbVv7JsFLkdogY4EKZnedaTmcNbREr2V",
  "v7M1UyZ4JZCqGvMwfCqWApGcfO38YfWF",
  "1hGyzdESzsCTQXXM8h9Nxm5KYJ2Cn3Kf",
  "EhdmkZAqkUX5B8uLKk0IAJfLpTEFzCnCCMWslGUDgZkRQ2GZr41CdFmYjHBlJYWs",
  "IyvYbRcFlXps4h2i3ux7ssJ9CqqEuZhH",
  "67qlxa1JXzhMJ7SfDOpTBUdtCnUJdWGB",
  "lnuhX5NRru21LVBqsUG4wfVkbSRbZsuk",
  "pdwYZ2GYpJVI2hFfk9QUrGxnscu95qlV",
  "1Dugj46434khucFBssN5IDRcqZWf7rPE",
  "qzlRFWs5sfwywcK84XfnPPJgcfoUOCgM",
  "OU6fN1pZuV0Ja3XusZkXeLS0MFjgt4MG",
  "V9REI55pONPk5vIqxUa0fNIMmLbOn8NF",
  "93Sp3UieY0lwiKJW7aQQlZJd1v22aymh",
  "PWVIHZbyNgHnUWJITCjyaRgY0Uu1yyjo",
  "TH1S4LY6HKXlWVeeg8gsctWQswTJv92b",
  "Eoyf18x6KmLM2c2Y7mbf4Hhh805cTYJD",
  "Ryl6Qv3Qsoi18IELetw2ewpI6o5RLJo5",
  "4Ott9LabCwfOKbMhGnVeYi3Ix0mGuB9d",
  "pHsVHUJoxpJ7GxEJFfiB6tF4HgFXtKNf",
  "xeDUCvo4LfqV63YylEOUmUbOc3430ALY"
];

async function seedArsenal() {
  console.log(`Starting to seed ${keys.length} keys into api_keys as Mistral...`);
  
  // Cleanup wrong groq keys
  console.log("Cleaning up previously seeded wrong groq keys...");
  await prisma.api_keys.deleteMany({
    where: {
      provider: 'groq',
      key: { in: keys }
    }
  });
  
  let count = 0;
  for (const key of keys) {
    try {
      await prisma.api_keys.upsert({
        where: {
          provider_key: {
            provider: 'mistral',
            key: key
          }
        },
        update: {
          is_active: true
        },
        create: {
          provider: 'mistral',
          key: key,
          is_active: true,
          is_backup: true
        }
      });
      count++;
      if (count % 10 === 0) console.log(`Seeded ${count} keys...`);
    } catch (e) {
      console.error(`Failed to seed key ${key.slice(0, 5)}...:`, e);
    }
  }
  
  console.log(`Successfully seeded ${count} keys.`);
  await prisma.$disconnect();
}

seedArsenal();
