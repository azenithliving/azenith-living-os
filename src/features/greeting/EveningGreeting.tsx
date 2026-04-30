import React from 'react';
import './EveningGreeting.css';

const EveningGreeting: React.FC = () => {
  return (
    <div className="evening-greeting-container">
      <h1 className="greeting-text">مساء الخير</h1>
      <p className="sub-text">لقد وصل الوقت للتنفس العميق والاسترخاء</p>
    </div>
  );
};

export default EveningGreeting;
