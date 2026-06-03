import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useState } from "react";
import { Card } from "./card";

export interface CardOption {
  id: string;
  icon: ReactNode;
  name: string;
}

interface AnimatedCardOptionsProps {
  options: CardOption[];
  columns?: number;
  onSelect?: (option: CardOption) => void;
}

export function AnimatedCardOptions({ options, columns = 4, onSelect }: AnimatedCardOptionsProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [fadingCards, setFadingCards] = useState<Set<string>>(new Set());

  const cardVariants = {
    initial: { opacity: 0, scale: 0.8, y: 20 },
    animate: (index: number) => ({
      opacity: 1,
      scale: [0.8, 1.01, 1],
      y: 0,
      transition: {
        duration: 0.5,
        delay: index * 0.05,
        type: "spring" as const,
        stiffness: 500,
        damping: 25,
        scale: { type: "tween" as const, duration: 0.5, ease: [0.175, 0.885, 0.32, 1.275] },
      },
    }),
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  };

  const hoverVariants = {
    hover: { scale: 1.05, transition: { type: "spring" as const, stiffness: 400, damping: 10 } },
  };

  const handleCardClick = (option: CardOption) => {
    if (selectedCard) return;
    setSelectedCard(option.id);
    const otherCards = options.filter((opt) => opt.id !== option.id);
    otherCards.forEach((card) => {
      setTimeout(() => {
        setFadingCards((prev) => new Set([...prev, card.id]));
      }, Math.random() * 300);
    });
    onSelect?.(option);
  };

  const shouldShowCard = (cardId: string) => {
    if (!selectedCard) return true;
    if (selectedCard === cardId) return true;
    return !fadingCards.has(cardId);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto relative">
      {options.map((option, index) => (
        <div key={option.id} className="relative">
          <AnimatePresence mode="wait">
            {shouldShowCard(option.id) ? (
              <motion.div
                key={`card-${option.id}`}
                className={`relative group cursor-pointer ${selectedCard === option.id ? "z-10" : ""}`}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                custom={index}
                whileHover={selectedCard ? {} : "hover"}
                onClick={() => handleCardClick(option)}
              >
                <motion.div variants={hoverVariants}>
                  <Card className="h-24 w-full border border-white/10 hover:border-white/25 transition-colors duration-200 bg-white/[0.04] backdrop-blur-sm">
                    <div className="flex items-center h-full px-3 sm:px-4 space-x-2 sm:space-x-3">
                      <div className="text-xl sm:text-2xl opacity-80 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                        {option.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm font-medium text-white/80 group-hover:text-white transition-colors duration-200 truncate">
                          {option.name}
                        </h3>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </motion.div>
            ) : (
              <div key={`placeholder-${option.id}`} className="h-24 w-full" />
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
