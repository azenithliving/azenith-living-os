"use client";
import axios from 'axios';

const fetchData = async (req, res) => {
  const url = req.query.url;
  try {
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في سحب البيانات' });
  }
};

export default fetchData;
