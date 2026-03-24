import React from 'react';

interface BusinessNameWordmarkProps {
    name: string;
    className?: string;
}

const FIRST_WORD_COLOR = '#0F172A';
const SECOND_WORD_COLOR = '#3B82F6';

const BusinessNameWordmark: React.FC<BusinessNameWordmarkProps> = ({ name, className }) => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        return null;
    }

    if (words.length === 1) {
        return (
            <span className={className}>
                <span style={{ color: FIRST_WORD_COLOR }}>{words[0]}</span>
            </span>
        );
    }

    const firstWord = words[0];
    const remainingWords = words.slice(1).join(' ');

    return (
        <span className={className}>
            <span style={{ color: FIRST_WORD_COLOR }}>{firstWord}</span>{' '}
            <span style={{ color: SECOND_WORD_COLOR }}>{remainingWords}</span>
        </span>
    );
};

export default BusinessNameWordmark;
