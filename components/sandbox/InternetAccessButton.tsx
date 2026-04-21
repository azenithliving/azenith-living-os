import React from 'react';

const InternetAccessButton = () => {
  const handleInternetAccess = async () => {
    try {
      const response = await fetch('https://api.example.com/internet-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grantAccess: true
        })
      });
      if (response.ok) {
        alert('Internet access granted');
      } else {
        alert('Internet access denied');
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <button onClick={handleInternetAccess}>Grant Internet Access</button>
  );
};

export default InternetAccessButton;