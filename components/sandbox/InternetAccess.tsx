import React, { useState } from 'react';
import axios from 'axios';

interface InternetItem {
  id: string | number;
  title: string;
}

const InternetAccess = () => {
  const [data, setData] = useState<InternetItem[]>([]);

  const fetchData = async () => {
    try {
      const response = await axios.get('https://api.example.com/data');
      setData(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <button onClick={fetchData}>Fetch Data</button>
      <ul>
        {data.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
};

export default InternetAccess;
