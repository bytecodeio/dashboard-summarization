import React, {useState} from 'react';
import { sendRating } from '../utils/sendRating';

interface RatingProps {
    hash: string;
    restfulService: string;
    extensionSDK: any;
}

export const Rating: React.FC<RatingProps> = ({ hash, restfulService, extensionSDK }) => {
    const [selectedRating, setSelectedRating] = useState<number | null>(null);

    const handleRating = async (rating: number) => {
        setSelectedRating(rating);
        await sendRating(hash, rating, restfulService, extensionSDK);
      };

    return (
        <div className="rating">
          <h3>Rate the Summary</h3>
          <div className="thumb-container">
            <button
              className={`thumb-button ${selectedRating === 1 ? 'selected' : ''}`}
              onClick={() => handleRating(1)}
            >
              👍
            </button>
            <button
              className={`thumb-button ${selectedRating === -1 ? 'selected' : ''}`}
              onClick={() => handleRating(-1)}
            >
              👎
            </button>
          </div>
        </div>
      );
};

export default Rating;