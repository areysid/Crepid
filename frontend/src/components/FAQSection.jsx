"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

const FAQSection = ({ faqs }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="mt-6 max-w-screen mx-0">
      {/* Section Title */}
      <h2 className="text-xl font-bold mb-3 text-left">FAQs</h2>

      <div className="divide-y rounded-lg overflow-hidden shadow-sm border bg-background/60 backdrop-blur">
        {faqs.map((faq, index) => (
          <Card
            key={index}
            className="cursor-pointer border-0 shadow-none rounded-none"
          >
            <CardHeader
              className="flex justify-between items-center px-4 hover:bg-muted/40 transition"
              onClick={() => toggleFAQ(index)}
            >
              <CardTitle className="text-sm font-medium text-left">
                {faq.question}
              </CardTitle>
              {openIndex === index ? (
                <ChevronUp className="w-4 h-4 shrink-0 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0 ml-2" />
              )}
            </CardHeader>

            {openIndex === index && (
              <CardContent className="px-4 py-2 text-sm text-muted-foreground text-left">
                {faq.answer}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FAQSection;
