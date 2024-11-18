import React from 'react';
import { sendRating } from '../utils/sendRating';

interface RatingProps {
    hash: string;
    restfulService: string;
    extensionSDK: any;
}

export const Rating: React.FC<RatingProps> = ({ hash, restfulService, extensionSDK }) => {
    const handleRating = async (rating: number) => {
        await sendRating(hash, rating, restfulService, extensionSDK);
    };

    const smileys = ['😟', '😞', '😐', '🙂', '😊'];

    return (
        <div className="rating">
            <div className="smiley-container">
                <h3>Rate the Summary</h3>
                {smileys.map((smiley, index) => (
                    <button key={index} onClick={() => handleRating(index + 1)} className="smiley-button">
                        <span role="img" aria-label={`Rating ${index + 1}`}>{smiley}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Rating;