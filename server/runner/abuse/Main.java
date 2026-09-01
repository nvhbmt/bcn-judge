// Ca số 0 cho java17: JVM sinh khá nhiều thread, đây cũng là phép thử trần
// --pids-limit 64 của §3.2 có đủ cho JVM không.
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        if (in.hasNextLong()) {
            long a = in.nextLong();
            long b = in.nextLong();
            System.out.println(a + b);
        } else {
            System.out.println("hello");
        }
    }
}
