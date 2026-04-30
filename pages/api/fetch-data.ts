import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

const fetchData = async (req: NextApiRequest, res: NextApiResponse) => {
  const url = req.query.url;
  if (typeof url !== 'string') {
    return res.status(400).json({ message: 'Missing url parameter' });
  }
  try {
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في سحب البيانات' });
  }
};

export default fetchData;
