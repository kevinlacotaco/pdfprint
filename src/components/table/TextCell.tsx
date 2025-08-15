export type TextCellProps = {
    value?: string;
};

export const TextCell =
    ({ value, }: TextCellProps) => {
        return (
            <div
                className="truncate p-1.5 w-full"
                title={value}
            >
                {value}
            </div>
        );
    };