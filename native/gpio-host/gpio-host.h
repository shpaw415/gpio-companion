#ifndef GPIO_COMPANION_GPIO_HOST_H
#define GPIO_COMPANION_GPIO_HOST_H

void gpio_host_init(int argc, char **argv);
void gpio_host_shutdown(void);
int gpio_host_stopping(void);

#endif
